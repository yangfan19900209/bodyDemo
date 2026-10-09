import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import type { Bounds } from './anatomy';

interface GlbNode { children?: number[]; mesh?: number; extras?: { structureId?: string }; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }
interface GlbDocument {
  scene?: number;
  scenes: { nodes: number[] }[];
  nodes: GlbNode[];
  meshes: { primitives: { attributes: { POSITION: number } }[] }[];
  accessors: { bufferView?: number; byteOffset?: number; count: number; type: string; componentType: number }[];
  bufferViews: { buffer?: number; byteOffset?: number; byteStride?: number; byteLength: number }[];
}

/** Inspect the actual binary asset independently of viewer state. */
export function rawStructureBounds(bytes: Uint8Array): Map<string, Bounds> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length) throw new Error('Invalid GLB 2.0 header');
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a) throw new Error('GLB JSON chunk missing');
  const document = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).trim()) as GlbDocument;
  const binaryHeader = 20 + jsonLength;
  if (view.getUint32(binaryHeader + 4, true) !== 0x004e4942) throw new Error('Local GLB binary chunk missing');
  const binaryStart = binaryHeader + 8;
  const boxes = new Map<string, Box3>();
  const accessorBoxes = new Map<number, Box3>();
  function positionBounds(index: number): Box3 {
    if (accessorBoxes.has(index)) return accessorBoxes.get(index)!.clone();
    const accessor = document.accessors[index]!;
    if (accessor.type !== 'VEC3' || accessor.componentType !== 5126 || accessor.bufferView === undefined) throw new Error('Expected real local Float32 POSITION vertices');
    const buffer = document.bufferViews[accessor.bufferView]!;
    const start = binaryStart + (buffer.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const stride = buffer.byteStride ?? 12;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let vertex = 0; vertex < accessor.count; vertex++) for (let axis = 0; axis < 3; axis++) {
      const value = view.getFloat32(start + vertex * stride + axis * 4, true);
      if (!Number.isFinite(value)) throw new Error('Non-finite actual GLB position');
      min[axis] = Math.min(min[axis]!, value); max[axis] = Math.max(max[axis]!, value);
    }
    const box = new Box3(new Vector3().fromArray(min), new Vector3().fromArray(max));
    accessorBoxes.set(index, box);
    return box.clone();
  }
  function visit(index: number, parent: Matrix4, inheritedId?: string): void {
    const node = document.nodes[index]!;
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]), new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new Vector3().fromArray(node.scale ?? [1, 1, 1]));
    const world = parent.clone().multiply(local);
    const id = node.extras?.structureId ?? inheritedId;
    if (node.mesh !== undefined && id) {
      const box = boxes.get(id) ?? new Box3();
      for (const primitive of document.meshes[node.mesh]!.primitives) {
        box.union(positionBounds(primitive.attributes.POSITION).applyMatrix4(world));
      }
      boxes.set(id, box);
    }
    node.children?.forEach((child) => visit(child, world, id));
  }
  for (const node of document.scenes[document.scene ?? 0]!.nodes) visit(node, new Matrix4());
  return new Map([...boxes].map(([id, box]) => [id, { min: box.min.toArray(), max: box.max.toArray() }]));
}

export function applySharedTransform(bounds: Bounds, transform: { position: number[]; scale: number[] }): Bounds {
  return {
    min: bounds.min.map((value, index) => value * transform.scale[index]! + transform.position[index]!),
    max: bounds.max.map((value, index) => value * transform.scale[index]! + transform.position[index]!),
  };
}

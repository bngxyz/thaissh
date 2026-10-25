import { useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Keyboard, Plus, X } from "lucide-react";
import { KEY_IDS, type KeyId } from "../../shared/types";
import { useStore } from "../store";
import { Modal } from "./Modal";
import { KEY_DESCRIPTIONS, KEY_LABELS } from "./KeyBar";

const PRESET_NAMES = { default: "ค่าเริ่มต้น", minimal: "น้อยที่สุด", arrows: "ลูกศรก่อน", power: "สายเทอร์มินัล" } as const;

function SortableKey({ id, onRemove }: { id: KeyId; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`edit-key${isDragging ? " is-dragging" : ""}`}
      title={KEY_DESCRIPTIONS[id]}
      {...attributes}
      {...listeners}
    >
      <span>{id === "IME" ? <Keyboard size={15} /> : KEY_LABELS[id]}</span>
      <button
        className="edit-key-x"
        aria-label={`เอา ${id} ออก`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
      >
        <X size={11} />
      </button>
    </div>
  );
}

export function KeyBarEditor() {
  const settings = useStore((s) => s.settings)!;
  const presets = useStore((s) => s.presets)!;
  const update = useStore((s) => s.updateSettings);
  const set = useStore((s) => s.set);
  const [keys, setKeys] = useState<KeyId[]>(settings.keyBarLayout);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setKeys((k) => arrayMove(k, k.indexOf(e.active.id as KeyId), k.indexOf(e.over!.id as KeyId)));
  };

  const unused = KEY_IDS.filter((k) => !keys.includes(k));
  const close = () => set({ keyBarEditorOpen: false });

  return (
    <Modal
      title="ปรับแต่งแถบปุ่ม"
      icon={<Keyboard size={18} />}
      onClose={close}
      width={640}
      footer={
        <>
          <button className="btn ghost" onClick={close}>ยกเลิก</button>
          <button className="btn primary" disabled={keys.length === 0} onClick={() => { void update({ keyBarLayout: keys }); close(); }}>บันทึก</button>
        </>
      }
    >
      <div className="presets">
        {(Object.keys(presets) as (keyof typeof presets)[]).map((p) => (
          <button key={p} className="btn small" onClick={() => setKeys(presets[p])}>{PRESET_NAMES[p]}</button>
        ))}
      </div>

      <div className="edit-label">ปุ่มที่ใช้ — ลากเพื่อเรียงลำดับ</div>
      <div className="edit-row">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={keys} strategy={horizontalListSortingStrategy}>
            {keys.map((k) => (
              <SortableKey key={k} id={k} onRemove={() => setKeys((ks) => ks.filter((x) => x !== k))} />
            ))}
          </SortableContext>
        </DndContext>
        {keys.length === 0 && <span className="muted small">เพิ่มอย่างน้อย 1 ปุ่ม</span>}
      </div>

      <div className="edit-label">ปุ่มที่เพิ่มได้</div>
      <div className="edit-row available">
        {unused.length === 0 && <span className="muted small">ใช้ครบทุกปุ่มแล้ว</span>}
        {unused.map((k) => (
          <button key={k} className="edit-key add" title={KEY_DESCRIPTIONS[k]} onClick={() => setKeys((ks) => [...ks, k])}>
            <Plus size={12} />{k === "IME" ? <Keyboard size={15} /> : KEY_LABELS[k]}
          </button>
        ))}
      </div>
    </Modal>
  );
}

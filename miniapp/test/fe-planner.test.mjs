import test from "node:test";
import assert from "node:assert/strict";

test("FE Planner: Reordering items updates orderIndex correctly", () => {
  const items = [
    { placeId: "p1", title: "Điểm 1", orderIndex: 0 },
    { placeId: "p2", title: "Điểm 2", orderIndex: 1 },
    { placeId: "p3", title: "Điểm 3", orderIndex: 2 },
  ];

  // Move item 1 (index 1) UP to index 0
  const reordered = [...items];
  const temp = reordered[1];
  reordered[1] = reordered[0];
  reordered[0] = temp;
  reordered.forEach((it, idx) => {
    it.orderIndex = idx;
  });

  assert.equal(reordered[0].title, "Điểm 2");
  assert.equal(reordered[0].orderIndex, 0);
  assert.equal(reordered[1].title, "Điểm 1");
  assert.equal(reordered[1].orderIndex, 1);
});

test("FE Planner: Deleting item re-indexes remaining items without gaps", () => {
  const items = [
    { placeId: "p1", title: "Điểm 1", orderIndex: 0 },
    { placeId: "p2", title: "Điểm 2", orderIndex: 1 },
    { placeId: "p3", title: "Điểm 3", orderIndex: 2 },
  ];

  // Delete item at index 1
  const remaining = items.filter((_, idx) => idx !== 1);
  remaining.forEach((it, idx) => {
    it.orderIndex = idx;
  });

  assert.equal(remaining.length, 2);
  assert.equal(remaining[0].title, "Điểm 1");
  assert.equal(remaining[0].orderIndex, 0);
  assert.equal(remaining[1].title, "Điểm 3");
  assert.equal(remaining[1].orderIndex, 1);
});

test("FE Planner: Children count cannot exceed total travelers", () => {
  const validateTravelers = (total, children) => {
    if (children > total) {
      throw new Error("Số lượng trẻ em không thể vượt quá tổng số người");
    }
    return true;
  };

  assert.equal(validateTravelers(4, 2), true);
  assert.throws(() => validateTravelers(2, 3), /Số lượng trẻ em không thể vượt quá tổng số người/);
});

test("FE Planner: VR360 destinations retain virtual experience notice", () => {
  const placeVR = {
    id: "vr360-dien-gio",
    name: "Điện gió Đắk Song",
    sourceType: "vr360",
    shortDescription: "Ngắm đồi thông và tuabin gió",
  };

  let notes = "";
  if (placeVR.sourceType === "vr360") {
    notes = `[Điểm thực tế ảo VR360] ${placeVR.shortDescription}`;
  }

  assert.ok(notes.includes("[Điểm thực tế ảo VR360]"));
});

test("FE Planner: Recalculates timeline hours chronologically when items change", () => {
  function recalculateDaySchedule(items, dayStartTime = "08:30") {
    let [h, m] = dayStartTime.split(":").map(Number);
    return items.map((item, idx) => {
      let plannedTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (item.itemType === "meal" && (h < 11 || (h === 11 && m < 30))) {
        h = 11;
        m = 45;
        plannedTime = "11:45";
      }
      const duration = item.durationMinutes || 60;
      const transitMin = item.itemType === "meal" || item.itemType === "rest" ? 0 : 20;
      m += duration + transitMin;
      while (m >= 60) {
        h += 1;
        m -= 60;
      }
      return { ...item, plannedTime, orderIndex: idx };
    });
  }

  const dayItems = [
    { title: "Điểm 1", itemType: "place", durationMinutes: 60 },
    { title: "Nghỉ trưa", itemType: "meal", durationMinutes: 75 },
    { title: "Điểm 2", itemType: "place", durationMinutes: 90 },
  ];

  const sched = recalculateDaySchedule(dayItems, "08:30");
  assert.equal(sched[0].plannedTime, "08:30");
  assert.equal(sched[1].plannedTime, "11:45");
  // 11:45 + 75m = 13:00 -> Next item at 13:00
  assert.equal(sched[2].plannedTime, "13:00");
});

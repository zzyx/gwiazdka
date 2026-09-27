import { describe, expect, it } from "vitest";
import { TASK_ICONS } from "../../lib/task-icons";
import { hasLineIcon } from "./task-icon";

describe("TaskIcon", () => {
  it("has a line icon for every icon the parent can pick", () => {
    expect(TASK_ICONS.filter((icon) => !hasLineIcon(icon))).toEqual([]);
  });
});

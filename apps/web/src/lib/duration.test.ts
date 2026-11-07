import { describe, expect, it } from "vitest";

import { planEndLabel } from "./duration";

describe("planEndLabel", () => {
  it("says where planned work ends, past midnight too, or that it has no time", () => {
    expect(planEndLabel("20:00", 60)).toBe("Ends 21:00");
    expect(planEndLabel("23:30", 90)).toBe("Ends 01:00 next day");
    expect(planEndLabel("", 60)).toBe("Untimed");
    expect(planEndLabel(null, 60)).toBe("Untimed");
    expect(planEndLabel("09:00", null)).toBeNull();
  });
});

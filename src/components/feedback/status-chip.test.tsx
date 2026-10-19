/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { StatusChip } from "@/components/feedback/status-chip";

describe("StatusChip", () => {
  it("shows not assessed instead of a zero for a pending result", () => {
    render(<StatusChip status="pending" />);
    expect(screen.getByText("Not assessed")).toBeInTheDocument();
  });

  it("keeps an explicit not-applicable result distinct from a miss", () => {
    render(<StatusChip status="not_applicable" />);
    expect(screen.getByText("Not applicable")).toBeInTheDocument();
  });
});

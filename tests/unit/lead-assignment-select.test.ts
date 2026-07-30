// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, screen } from "@testing-library/react";

vi.mock("@/lib/actions", () => ({
  assignLeadToUser: vi.fn(),
  removeLeadAssignment: vi.fn(),
}));

import { LeadAssignmentSelect } from "@/app/components/LeadAssignmentSelect";

afterEach(() => {
  cleanup();
});

describe("LeadAssignmentSelect — canReassign", () => {
  it("canReassign=false desabilita o select mesmo com vendedores disponíveis", () => {
    render(
      createElement(LeadAssignmentSelect, {
        leadId: "lead-1",
        assignedTo: null,
        vendedores: [{ id: "u1", nome: "Carlos" }],
        canReassign: false,
      })
    );

    const select = screen.getByLabelText("Atribuir vendedor") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it("canReassign=true (ou omitido) mantém o select habilitado", () => {
    render(
      createElement(LeadAssignmentSelect, {
        leadId: "lead-1",
        assignedTo: null,
        vendedores: [{ id: "u1", nome: "Carlos" }],
      })
    );

    const select = screen.getByLabelText("Atribuir vendedor") as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });
});

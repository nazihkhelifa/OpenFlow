import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProjectsOnboardingDialog } from "@/components/projects/ProjectsOnboardingDialog";

const mockGetDefaultProjectDirectory = vi.fn(() => "");
const mockSetDefaultProjectDirectory = vi.fn();

vi.mock("@/store/utils/localStorage", () => ({
  getDefaultProjectDirectory: () => mockGetDefaultProjectDirectory(),
  setDefaultProjectDirectory: (path: string) => mockSetDefaultProjectDirectory(path),
}));

describe("ProjectsOnboardingDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDefaultProjectDirectory.mockReturnValue("");
    global.fetch = vi.fn();
  });

  it("renders when open and shows setup actions", () => {
    render(
      <ProjectsOnboardingDialog
        isOpen={true}
        onStart={vi.fn()}
        onOpenSetup={vi.fn()}
      />
    );

    expect(screen.getByText("Welcome to Projects")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open setup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <ProjectsOnboardingDialog
        isOpen={false}
        onStart={vi.fn()}
        onOpenSetup={vi.fn()}
      />
    );

    expect(screen.queryByText("Welcome to Projects")).not.toBeInTheDocument();
  });

  it("saves the entered default directory", () => {
    render(
      <ProjectsOnboardingDialog
        isOpen={true}
        onStart={vi.fn()}
        onOpenSetup={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("/Users/username/projects"), {
      target: { value: "/tmp/projects" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mockSetDefaultProjectDirectory).toHaveBeenCalledWith("/tmp/projects");
  });

  it("loads selected directory from browse API", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ success: true, path: "/selected/path" }),
    } as Response);

    render(
      <ProjectsOnboardingDialog
        isOpen={true}
        onStart={vi.fn()}
        onOpenSetup={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("/selected/path")).toBeInTheDocument();
    });
  });
});

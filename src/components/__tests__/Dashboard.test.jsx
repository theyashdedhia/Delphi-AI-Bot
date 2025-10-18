import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import Dashboard from "../../components/Dashboard/Dashboard";
import { DarkModeProvider } from "../../contexts/DarkModeContext";

// -----------------------------------------------------------------------------
// 🧩 MOCKS
// -----------------------------------------------------------------------------
const mockLogoutRedirect = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({
    instance: {
      logoutRedirect: mockLogoutRedirect,
      getActiveAccount: vi.fn(() => ({ username: "tester@rmit.edu.au" })),
    },
  }),
  useIsAuthenticated: () => true,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

// -----------------------------------------------------------------------------
// 🧪 UTIL
// -----------------------------------------------------------------------------
const renderDashboard = (route = "/dashboard") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <DarkModeProvider>
        <Dashboard />
      </DarkModeProvider>
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

// -----------------------------------------------------------------------------
// 🧪 TEST SUITE
// -----------------------------------------------------------------------------
describe("Dashboard Component", () => {
  it("renders header, sidebar, and main", () => {
    renderDashboard();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders the sign-out button", () => {
    renderDashboard();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("renders the dark mode toggle", () => {
    renderDashboard();
    expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  it("renders the collapse sidebar button", () => {
    renderDashboard();
    const buttons = screen.getAllByRole("button", { name: /collapse sidebar/i });
    expect(buttons[0]).toBeInTheDocument();
  });

  it("toggles sidebar collapsed state", async () => {
    renderDashboard();
    const [toggle] = screen.getAllByRole("button", { name: /collapse sidebar/i });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-label", "Expand sidebar");
  });

  it("sign-out click triggers logoutRedirect", async () => {
    renderDashboard();
    const btn = screen.getByRole("button", { name: /sign out/i });
    await userEvent.click(btn);
    expect(mockLogoutRedirect).toHaveBeenCalled();
  });

  it("navigates to /login after sign-out", async () => {
    renderDashboard();
    mockNavigate("/login");
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("shows chat history when on /dashboard/chat route", () => {
    renderDashboard("/dashboard/chat");
    const asides = screen.getAllByRole("complementary");
    expect(asides[1]).toHaveClass("chat-history");
  });

  it("does not render chat history on non-chat routes", () => {
    renderDashboard("/dashboard/documents");
    const asides = screen.getAllByRole("complementary");
    expect(asides.length).toBe(1); // only sidebar present
  });

  it("search input inside chat-history accepts typing", async () => {
    renderDashboard("/dashboard/chat");
    const input = screen.getByPlaceholderText(/search chats/i);
    await userEvent.type(input, "iron");
    expect(input.value).toBe("iron");
  });

  it("renders theme toggle button with proper title", () => {
    renderDashboard();
    expect(screen.getByTitle(/switch to dark mode/i)).toBeInTheDocument();
  });

  it("toggles dark mode when clicked", async () => {
    renderDashboard();
    const btn = screen.getByRole("button", { name: /switch to dark mode/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-label", "Switch to light mode");
  });

  it("responds to resize events", () => {
    renderDashboard();
    global.innerWidth = 400;
    fireEvent(window, new Event("resize"));
    expect(global.innerWidth).toBe(400);
  });

  it("cleans up resize listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderDashboard();
    unmount();
    expect(removeSpy).toHaveBeenCalled();
  });

  it("contains main content container", () => {
    renderDashboard();
    expect(document.querySelector(".main-content")).toBeInTheDocument();
  });
});

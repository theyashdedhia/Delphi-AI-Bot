import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import Login from "../../pages/auth/Login";

// -----------------------------------------------------------------------------
// 🧩 MOCKS
// -----------------------------------------------------------------------------
const mockLoginRedirect = vi.fn();
const mockLogoutRedirect = vi.fn();
const mockAcquireTokenSilent = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({
    instance: {
      loginRedirect: mockLoginRedirect,
      logoutRedirect: mockLogoutRedirect,
      acquireTokenSilent: mockAcquireTokenSilent,
    },
  }),
  useIsAuthenticated: () => false,
  MsalProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => vi.clearAllMocks());

// -----------------------------------------------------------------------------
// 🧪 TESTS
// -----------------------------------------------------------------------------
describe("Login Page", () => {
  // --- BASIC RENDERING ---
  it("renders the correct heading text", () => {
    render(<Login />);
    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
  });

  it("renders brand tagline text", () => {
    render(<Login />);
    expect(screen.getByText(/decision insights for lifeblood/i)).toBeInTheDocument();
  });

  it("renders the Microsoft sign-in button", () => {
    render(<Login />);
    const btn = screen.getByRole("button", { name: /sign in with microsoft/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass("btn--microsoft");
  });

  // --- INTERACTION ---
  it("calls MSAL loginRedirect when button is clicked", async () => {
    render(<Login />);
    await userEvent.click(screen.getByRole("button", { name: /sign in with microsoft/i }));
    expect(mockLoginRedirect).toHaveBeenCalledTimes(1);
  });

  it("responds to Enter key press", async () => {
    render(<Login />);
    const btn = screen.getByRole("button", { name: /sign in with microsoft/i });
    btn.focus();
    await userEvent.keyboard("{Enter}");
    expect(mockLoginRedirect).toHaveBeenCalledTimes(1);
  });

  it("responds to Space key press", async () => {
    render(<Login />);
    const btn = screen.getByRole("button", { name: /sign in with microsoft/i });
    btn.focus();
    await userEvent.keyboard(" ");
    expect(mockLoginRedirect).toHaveBeenCalledTimes(1);
  });

  // --- NAVIGATION ---
  it("navigates to /dashboard after loginRedirect", async () => {
    render(<Login />);
    await userEvent.click(screen.getByRole("button", { name: /sign in with microsoft/i }));
    mockNavigate("/dashboard");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  // --- LEGAL & FOOTER ---
  it("renders Terms and Privacy Policy links", () => {
    render(<Login />);
    expect(screen.getByText(/terms/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy policy/i)).toBeInTheDocument();
  });

  it("legal text includes 'By continuing, you agree'", () => {
    render(<Login />);
    expect(screen.getByText(/by continuing, you agree/i)).toBeInTheDocument();
  });

  // --- ARIA / ACCESSIBILITY ---
  it("main element has role=main", () => {
    render(<Login />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("section uses aria-labelledby correctly", () => {
    render(<Login />);
    const section = screen.getByRole("region", { name: /welcome back/i });
    expect(section).toHaveAttribute("aria-labelledby", "welcome-title");
  });

  it("aside element has descriptive aria-label", () => {
    render(<Login />);
    const aside = screen.getByRole("complementary", { name: /brand illustration/i });
    expect(aside).toBeInTheDocument();
  });

  // --- BRAND / LAYOUT STRUCTURE ---
  it("renders the DELPHI brand word", () => {
    render(<Login />);
    expect(screen.getByText(/delphi/i)).toBeInTheDocument();
  });

  it("renders the subtext 'Please sign in to continue'", () => {
    render(<Login />);
    expect(screen.getByText(/please sign in to continue/i)).toBeInTheDocument();
  });
});

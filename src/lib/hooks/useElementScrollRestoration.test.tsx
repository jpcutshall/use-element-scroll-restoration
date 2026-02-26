/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useElementScrollRestoration } from "./useElementScrollRestoration";

const MOCK_KEY = "test-key";

function TestComponent({
  persist = false,
  debounceTime,
}: {
  persist?: false | "localStorage" | "sessionStorage";
  debounceTime?: number;
}) {
  const { ref, setScroll } = useElementScrollRestoration<HTMLDivElement>(
    MOCK_KEY,
    {
      persist,
      debounceTime,
    },
  );

  return (
    <div
      data-testid="scrollable"
      ref={ref}
      style={{ height: "100px", overflowY: "scroll" }}
    >
      <div style={{ height: "500px" }}>
        Content
        <button onClick={() => setScroll({ y: 150, x: 50 })}>Set Scroll</button>
      </div>
    </div>
  );
}

describe("useScrollRestoration", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should render without crashing and attach ref", () => {
    render(<TestComponent />);
    const scrollableDiv = screen.getByTestId("scrollable");
    expect(scrollableDiv).toBeInTheDocument();
  });

  it("should debounce scroll events and update localStorage if specified", () => {
    render(<TestComponent persist="localStorage" debounceTime={200} />);
    const scrollableDiv = screen.getByTestId("scrollable");

    // Expected initial save of 0, 0
    expect(localStorage.getItem(`scrollRestoration-${MOCK_KEY}`)).toEqual(
      JSON.stringify({ scrollTop: 0, scrollLeft: 0 }),
    );

    Object.defineProperty(scrollableDiv, "scrollTop", {
      value: 100,
      writable: true,
    });
    Object.defineProperty(scrollableDiv, "scrollLeft", {
      value: 0,
      writable: true,
    });

    // Trigger scroll event
    fireEvent.scroll(scrollableDiv);

    // Fast forward enough for the debounce to trigger
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Check localStorage directly
    expect(localStorage.getItem(`scrollRestoration-${MOCK_KEY}`)).toEqual(
      JSON.stringify({ scrollTop: 100, scrollLeft: 0 }),
    );
  });

  it("should restore scroll position from localStorage on mount", () => {
    // Prep the storage prior to mount
    localStorage.setItem(
      `scrollRestoration-${MOCK_KEY}`,
      JSON.stringify({ scrollTop: 250, scrollLeft: 0 }),
    );

    render(<TestComponent persist="localStorage" />);

    // Component should have called scrollTo with the stored values
    expect(Element.prototype.scrollTo).toHaveBeenCalledWith(0, 250);
  });

  it("should save to sessionStorage if specified", () => {
    render(<TestComponent persist="sessionStorage" debounceTime={100} />);
    const scrollableDiv = screen.getByTestId("scrollable");

    Object.defineProperty(scrollableDiv, "scrollTop", {
      value: 75,
      writable: true,
    });
    Object.defineProperty(scrollableDiv, "scrollLeft", {
      value: 15,
      writable: true,
    });

    fireEvent.scroll(scrollableDiv);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(sessionStorage.getItem(`scrollRestoration-${MOCK_KEY}`)).toEqual(
      JSON.stringify({ scrollTop: 75, scrollLeft: 15 }),
    );
  });

  it("should update scroll state when setScroll is called manually", () => {
    render(<TestComponent persist="localStorage" />);

    const setScrollButton = screen.getByText("Set Scroll");
    fireEvent.click(setScrollButton);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(
      JSON.parse(localStorage.getItem(`scrollRestoration-${MOCK_KEY}`) || "{}"),
    ).toEqual({ scrollTop: 150, scrollLeft: 50 });
  });
});

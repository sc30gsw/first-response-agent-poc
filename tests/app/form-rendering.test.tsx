// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useMutation: () => ({ isPending: false, mutate }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
    }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api-client", () => ({
  threadApiClient: { create: vi.fn() },
}));

vi.mock("@/lib/sample-cases", () => ({
  SAMPLE_CASES: [],
}));

vi.mock("@/shared/types/thread", () => ({
  truncateThreadTitle: (title: string) => title,
}));

vi.mock("@/lib/query-keys", () => ({
  threadQueryKeys: {
    detail: (id: string) => ["thread", id],
    lists: () => ["threads"],
  },
}));

vi.mock("@/app/_components/workspace-shell", () => ({
  WorkspaceShell: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
}));

import { ChatComposer, useChatMessageForm } from "@/app/_components/eve-chat";
import { WorkspaceHome } from "@/app/_components/workspace-home";

function ComposerHarness({ onSubmitMessage }: {
  readonly onSubmitMessage: (message: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const form = useChatMessageForm({ onSubmitMessage });
  return <ChatComposer form={form} inputRef={inputRef} isBusy={false} onStop={vi.fn()} />;
}

describe("フォーム移行後の公開挙動", () => {
  beforeEach(() => {
    mutate.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("案件名の入力で文字数カウンタが更新される", async () => {
    const user = userEvent.setup();
    render(<WorkspaceHome threads={[]} />);

    await user.type(screen.getByLabelText("案件名"), "相続した空き家");

    expect(screen.getByText("7 / 60 文字")).not.toBeNull();
  });

  it("案件名を60文字に切り詰める", () => {
    render(<WorkspaceHome threads={[]} />);
    const input = screen.getByLabelText("案件名") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "あ".repeat(61) } });

    expect(input.value).toHaveLength(60);
    expect(screen.getByText("60 / 60 文字")).not.toBeNull();
  });

  it("空の案件名の送信はエラー表示のみで作成せず、入力すると再送信できる", async () => {
    const user = userEvent.setup();
    render(<WorkspaceHome threads={[]} />);
    const input = screen.getByLabelText("案件名");
    const submitButton = screen.getByRole("button", { name: "この内容で相談を開始" }) as HTMLButtonElement;

    fireEvent.submit(input.closest("form")!);

    expect((await screen.findByRole("alert")).textContent).toContain("案件名を入力してください。");
    expect(mutate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    await waitFor(() => expect(submitButton.disabled).toBe(true));

    await user.type(input, "空き家の相談");

    await waitFor(() => expect(submitButton.disabled).toBe(false));
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(mutate).toHaveBeenCalledWith({ name: "空き家の相談", prompt: null }));
  });

  it("チャット入力が空の間は送信できず、入力後の送信でメッセージが親へ渡る", async () => {
    const user = userEvent.setup();
    const onSubmitMessage = vi.fn(async () => {});
    render(<ComposerHarness onSubmitMessage={onSubmitMessage} />);
    const sendButton = screen.getByRole("button", { name: "送信" }) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);

    await user.type(screen.getByLabelText("相談内容または追加情報"), "共有名義です");

    await waitFor(() => expect(sendButton.disabled).toBe(false));
    await user.click(sendButton);
    await waitFor(() => expect(onSubmitMessage).toHaveBeenCalledWith("共有名義です"));
  });
});

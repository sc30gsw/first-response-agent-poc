import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { Result, TaggedError } from "better-result";

export const authClient = createAuthClient({
  plugins: [anonymousClient()],
});

export type AnonymousAuthOperation =
  | "anonymous-sign-in"
  | "anonymous-user-delete";

export class AnonymousAuthError extends TaggedError("AnonymousAuthError")<{
  cause: unknown;
  message: string;
  operation: AnonymousAuthOperation;
  reason: "network_error" | "sdk_error";
  status: number | null;
}>() {}

type AnonymousSignInResult = Awaited<ReturnType<typeof authClient.signIn.anonymous>>;
type AnonymousDeleteResult = Awaited<ReturnType<typeof authClient.deleteAnonymousUser>>;
type AnonymousAuthSdkError = Partial<Pick<
  NonNullable<AnonymousSignInResult["error"] | AnonymousDeleteResult["error"]>,
  "message" | "status" | "statusText"
>>;

type AnonymousAuthSdkResponse = {
  readonly error: AnonymousAuthSdkError | null;
};

export type AnonymousAuthSdk = {
  readonly deleteAnonymousUser: () => Promise<AnonymousAuthSdkResponse>;
  readonly signInAnonymous: () => Promise<AnonymousAuthSdkResponse>;
};

async function runAuthOperation(
  operation: AnonymousAuthOperation,
  request: () => Promise<AnonymousAuthSdkResponse>,
): Promise<Result<void, AnonymousAuthError>> {
  const response = await Result.tryPromise({
    try: request,
    catch: cause => new AnonymousAuthError({
      cause,
      message: "Anonymous authentication request failed",
      operation,
      reason: "network_error",
      status: null,
    }),
  });
  if (Result.isError(response)) return Result.err(response.error);
  if (!response.value.error) return Result.ok(undefined);

  return Result.err(new AnonymousAuthError({
    cause: response.value.error,
    message: "Anonymous authentication was rejected by the SDK",
    operation,
    reason: "sdk_error",
    status: response.value.error.status ?? null,
  }));
}

async function runAuthMutation(
  result: Promise<Result<void, AnonymousAuthError>>,
): Promise<void> {
  const settled = await result;
  if (Result.isError(settled)) {
    // TanStack Query represents mutation failures by rejection. Keep that throw
    // at this adapter boundary and preserve the typed, documented reason.
    throw settled.error;
  }
}

export function createAnonymousAuthAdapter(
  sdk: AnonymousAuthSdk,
) {
  return {
    deleteAnonymousUser: () => runAuthMutation(runAuthOperation(
      "anonymous-user-delete",
      sdk.deleteAnonymousUser,
    )),
    signInAnonymous: () => runAuthMutation(runAuthOperation(
      "anonymous-sign-in",
      sdk.signInAnonymous,
    )),
  };
}

export type AnonymousAuthAdapter = ReturnType<typeof createAnonymousAuthAdapter>;

export const anonymousAuth = createAnonymousAuthAdapter({
  deleteAnonymousUser: () => authClient.deleteAnonymousUser(),
  signInAnonymous: () => authClient.signIn.anonymous(),
});

"use client";

import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

const { fieldContext, formContext } = createFormHookContexts();

// Keep form composition in one place so feature forms share the same typed
// AppForm/AppField boundary as they grow without adding reactive context
// values of their own.
export const { useAppForm } = createFormHook({
  fieldComponents: {},
  formComponents: {},
  fieldContext,
  formContext,
});

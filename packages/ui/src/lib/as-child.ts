import * as React from "react";

export type WithAsChild<T> = T & { asChild?: boolean };

export function withAsChild<
  // render can be ReactElement | ComponentRenderFn<...> in @base-ui — accept any
  P extends { children?: React.ReactNode; render?: unknown },
>(
  props: P & { asChild?: boolean }
): { render?: React.ReactElement; rest: Omit<P, "asChild"> } {
  const { asChild, ...rest } = props;
  if (asChild && React.isValidElement(rest.children)) {
    const child = rest.children as React.ReactElement<{
      children?: React.ReactNode;
    }>;
    return {
      render: React.cloneElement(child, {} as object) as React.ReactElement,
      rest: { ...rest, children: child.props.children } as Omit<P, "asChild">,
    };
  }
  return { render: undefined, rest: rest as Omit<P, "asChild"> };
}

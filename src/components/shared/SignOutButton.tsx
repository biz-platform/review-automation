"use client";

export function SignOutButton() {
  async function handleSignOut() {
    await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "same-origin",
    });
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="text-sm text-muted-foreground underline"
    >
      로그아웃
    </button>
  );
}

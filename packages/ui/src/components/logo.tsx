import { type ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-logo-mark-shadow" d="M12 16H4V8H12V16Z" fill="var(--icon-weak-base)" />
      <path data-slot="logo-logo-mark-o" d="M12 4H4V16H12V4ZM16 20H0V0H16V20Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M60 80H20V40H60V80Z" fill="var(--icon-base)" />
      <path d="M60 20H20V80H60V20ZM80 100H0V0H80V100Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 234 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g>
        <path d="M6 9h3v3h-3ZM21 9h3v3h-3ZM6 12h3v3h-3ZM21 12h3v3h-3ZM6 15h3v3h-3ZM21 15h3v3h-3ZM6 18h18v3h-18ZM6 21h3v3h-3ZM21 21h3v3h-3ZM6 24h3v3h-3ZM21 24h3v3h-3ZM6 27h3v3h-3ZM21 27h3v3h-3ZM6 30h3v3h-3ZM21 30h3v3h-3Z" fill="var(--icon-base)" />
        <path d="M33 15h6v3h-6Z" fill="var(--icon-weak-base)" />
        <path d="M33 9h6v3h-6ZM30 12h12v3h-12ZM30 15h3v3h-3ZM39 15h3v3h-3ZM27 18h18v3h-18ZM27 21h3v3h-3ZM42 21h3v3h-3ZM27 24h3v3h-3ZM42 24h3v3h-3ZM27 27h3v3h-3ZM42 27h3v3h-3ZM27 30h3v3h-3ZM42 30h3v3h-3Z" fill="var(--icon-base)" />
        <path d="M51 12h12v3h-12ZM51 15h12v3h-12Z" fill="var(--icon-weak-base)" />
        <path d="M48 9h15v3h-15ZM48 12h3v3h-3ZM63 12h3v3h-3ZM48 15h3v3h-3ZM63 15h3v3h-3ZM48 18h15v3h-15ZM48 21h3v3h-3ZM57 21h3v3h-3ZM48 24h3v3h-3ZM57 24h3v3h-3ZM48 27h3v3h-3ZM57 27h6v3h-6ZM48 30h3v3h-3ZM60 30h6v3h-6Z" fill="var(--icon-base)" />
        <path d="M69 9h18v3h-18ZM75 12h6v3h-6ZM75 15h6v3h-6ZM75 18h6v3h-6ZM75 21h6v3h-6ZM75 24h6v3h-6ZM75 27h6v3h-6ZM69 30h18v3h-18Z" fill="var(--icon-base)" />
        <path d="M93 9h15v3h-15ZM90 12h3v3h-3ZM90 15h3v3h-3ZM93 18h15v3h-15ZM105 21h3v3h-3ZM105 24h3v3h-3ZM105 27h3v3h-3ZM93 30h15v3h-15Z" fill="var(--icon-base)" />
        <path d="M111 9h3v3h-3ZM126 9h3v3h-3ZM111 12h3v3h-3ZM126 12h3v3h-3ZM111 15h3v3h-3ZM126 15h3v3h-3ZM111 18h18v3h-18ZM111 21h3v3h-3ZM126 21h3v3h-3ZM111 24h3v3h-3ZM126 24h3v3h-3ZM111 27h3v3h-3ZM126 27h3v3h-3ZM111 30h3v3h-3ZM126 30h3v3h-3Z" fill="var(--icon-base)" />
        <path d="M150 9h9v3h-9ZM147 12h3v3h-3ZM159 12h3v3h-3ZM144 15h3v3h-3ZM144 18h3v3h-3ZM144 21h3v3h-3ZM144 24h3v3h-3ZM147 27h3v3h-3ZM159 27h3v3h-3ZM150 30h9v3h-9Z" fill="var(--icon-strong-base)" />
        <path d="M171 9h6v3h-6ZM168 12h3v3h-3ZM177 12h3v3h-3ZM165 15h3v3h-3ZM180 15h3v3h-3ZM165 18h3v3h-3ZM180 18h3v3h-3ZM165 21h3v3h-3ZM180 21h3v3h-3ZM165 24h3v3h-3ZM180 24h3v3h-3ZM168 27h3v3h-3ZM177 27h3v3h-3ZM171 30h6v3h-6Z" fill="var(--icon-strong-base)" />
        <path d="M189 12h12v3h-12ZM189 15h12v3h-12ZM189 18h12v3h-12ZM189 21h12v3h-12ZM189 24h12v3h-12ZM189 27h12v3h-12Z" fill="var(--icon-weak-base)" />
        <path d="M189 9h12v3h-12ZM186 12h3v3h-3ZM201 12h3v3h-3ZM186 15h3v3h-3ZM201 15h3v3h-3ZM186 18h3v3h-3ZM201 18h3v3h-3ZM186 21h3v3h-3ZM201 21h3v3h-3ZM186 24h3v3h-3ZM201 24h3v3h-3ZM186 27h3v3h-3ZM201 27h3v3h-3ZM189 30h12v3h-12Z" fill="var(--icon-strong-base)" />
        <path d="M207 9h18v3h-18ZM207 12h3v3h-3ZM207 15h3v3h-3ZM207 18h15v3h-15ZM207 21h3v3h-3ZM207 24h3v3h-3ZM207 27h3v3h-3ZM207 30h18v3h-18Z" fill="var(--icon-strong-base)" />
      </g>
    </svg>
  )
}

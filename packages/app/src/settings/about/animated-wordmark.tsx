import { createEffect, For, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { prefersReducedMotion } from "@harishcode/ui/motion"

const target = ["h", "a", "r", "i", "s", "h", "c", "o", "d", "e"] as const

const choices = ["h", "a", "r", "i", "s", "c", "o", "d", "e"] as const

const letterId = (letter: string) => `settings-about-letter-${letter}`

// 18px glyphs on a 24px pitch, with a wider gap between the two words: "HARISH CODE".
const slots = [0, 24, 48, 72, 96, 120, 168, 192, 216, 240]

export function AnimatedWordmark(props: { active: boolean }) {
  const [state, setState] = createStore({ letters: [...target] })
  const timers = new Set<ReturnType<typeof setTimeout>>()

  createEffect(
    on(
      () => props.active,
      (active) => {
        timers.forEach(clearTimeout)
        timers.clear()

        if (!active || prefersReducedMotion()) {
          setState("letters", [...target])

          return
        }

        const starts = target.map(() => choices[Math.floor(Math.random() * choices.length)])
        const settles = target.map(() => 6 + Math.floor(Math.random() * 8))
        const last = Math.max(...settles)
        setState("letters", starts)

        Array.from({ length: last }, (_, index) => index + 1).forEach((tick) => {
          const timer = setTimeout(() => {
            setState(
              "letters",
              target.map((letter, index) =>
                tick >= settles[index] ? letter : choices[Math.floor(Math.random() * choices.length)],
              ),
            )
            timers.delete(timer)
          }, tick * 75)

          timers.add(timer)
        })
      },
    ),
  )

  onCleanup(() => timers.forEach(clearTimeout))

  return (
    <svg class="settings-about-wordmark" viewBox="0 0 258 42" aria-hidden="true">
      <defs>
        <symbol id={letterId("h")} viewBox="0 0 18 24">
          <path d="M0 0h3v3h-3ZM15 0h3v3h-3ZM0 3h3v3h-3ZM15 3h3v3h-3ZM0 6h3v3h-3ZM15 6h3v3h-3ZM0 9h18v3h-18ZM0 12h3v3h-3ZM15 12h3v3h-3ZM0 15h3v3h-3ZM15 15h3v3h-3ZM0 18h3v3h-3ZM15 18h3v3h-3ZM0 21h3v3h-3ZM15 21h3v3h-3Z" />
        </symbol>
        <symbol id={letterId("a")} viewBox="0 0 18 24">
          <path class="settings-about-letter-shadow" d="M6 6h6v3h-6Z" />
          <path d="M6 0h6v3h-6ZM3 3h12v3h-12ZM3 6h3v3h-3ZM12 6h3v3h-3ZM0 9h18v3h-18ZM0 12h3v3h-3ZM15 12h3v3h-3ZM0 15h3v3h-3ZM15 15h3v3h-3ZM0 18h3v3h-3ZM15 18h3v3h-3ZM0 21h3v3h-3ZM15 21h3v3h-3Z" />
        </symbol>
        <symbol id={letterId("r")} viewBox="0 0 18 24">
          <path class="settings-about-letter-shadow" d="M3 3h12v3h-12ZM3 6h12v3h-12Z" />
          <path d="M0 0h15v3h-15ZM0 3h3v3h-3ZM15 3h3v3h-3ZM0 6h3v3h-3ZM15 6h3v3h-3ZM0 9h15v3h-15ZM0 12h3v3h-3ZM9 12h3v3h-3ZM0 15h3v3h-3ZM9 15h3v3h-3ZM0 18h3v3h-3ZM9 18h6v3h-6ZM0 21h3v3h-3ZM12 21h6v3h-6Z" />
        </symbol>
        <symbol id={letterId("i")} viewBox="0 0 18 24">
          <path d="M0 0h18v3h-18ZM6 3h6v3h-6ZM6 6h6v3h-6ZM6 9h6v3h-6ZM6 12h6v3h-6ZM6 15h6v3h-6ZM6 18h6v3h-6ZM0 21h18v3h-18Z" />
        </symbol>
        <symbol id={letterId("s")} viewBox="0 0 18 24">
          <path d="M3 0h15v3h-15ZM0 3h3v3h-3ZM0 6h3v3h-3ZM3 9h15v3h-15ZM15 12h3v3h-3ZM15 15h3v3h-3ZM15 18h3v3h-3ZM3 21h15v3h-15Z" />
        </symbol>
        <symbol id={letterId("c")} viewBox="0 0 18 24">
          <path d="M6 0h9v3h-9ZM3 3h3v3h-3ZM15 3h3v3h-3ZM0 6h3v3h-3ZM0 9h3v3h-3ZM0 12h3v3h-3ZM0 15h3v3h-3ZM3 18h3v3h-3ZM15 18h3v3h-3ZM6 21h9v3h-9Z" />
        </symbol>
        <symbol id={letterId("o")} viewBox="0 0 18 24">
          <path d="M6 0h6v3h-6ZM3 3h3v3h-3ZM12 3h3v3h-3ZM0 6h3v3h-3ZM15 6h3v3h-3ZM0 9h3v3h-3ZM15 9h3v3h-3ZM0 12h3v3h-3ZM15 12h3v3h-3ZM0 15h3v3h-3ZM15 15h3v3h-3ZM3 18h3v3h-3ZM12 18h3v3h-3ZM6 21h6v3h-6Z" />
        </symbol>
        <symbol id={letterId("d")} viewBox="0 0 18 24">
          <path class="settings-about-letter-shadow" d="M3 3h12v3h-12ZM3 6h12v3h-12Z" />
          <path d="M3 0h12v3h-12ZM0 3h3v3h-3ZM15 3h3v3h-3ZM0 6h3v3h-3ZM15 6h3v3h-3ZM0 9h3v3h-3ZM15 9h3v3h-3ZM0 12h3v3h-3ZM15 12h3v3h-3ZM0 15h3v3h-3ZM15 15h3v3h-3ZM0 18h3v3h-3ZM15 18h3v3h-3ZM3 21h12v3h-12Z" />
        </symbol>
        <symbol id={letterId("e")} viewBox="0 0 18 24">
          <path d="M0 0h18v3h-18ZM0 3h3v3h-3ZM0 6h3v3h-3ZM0 9h15v3h-15ZM0 12h3v3h-3ZM0 15h3v3h-3ZM0 18h3v3h-3ZM0 21h18v3h-18Z" />
        </symbol>
      </defs>
      <For each={state.letters}>
        {(letter, index) => (
          <use href={`#${letterId(letter)}`} x={slots[index()]} y={9} width="18" height="24" />
        )}
      </For>
    </svg>
  )
}

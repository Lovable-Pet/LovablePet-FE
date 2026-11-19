/**
 * WebXR 화면(DOM overlay)에서 이 요소를 눌러도 XR select(개 끌기·돌리기·놓기)가 되지 않게 한다.
 * ref 콜백으로 붙인다 (React 19 는 돌려준 함수로 정리한다). 나중에 나타나는 시트·카드처럼 늘 있지 않은 요소용
 */
export function blockXrSelectRef(node: HTMLElement | null) {
  if (!node) return
  const block = (event: Event) => event.preventDefault()
  node.addEventListener('beforexrselect', block)
  return () => node.removeEventListener('beforexrselect', block)
}

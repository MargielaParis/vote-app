import { useCallback, useEffect, useRef, useState } from 'react'

const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n)

/**
 * when2meet식 사각형 드래그 선택 엔진 (표현과 분리된 헤드리스 훅).
 *
 * - Pointer Events 한 경로로 마우스·터치·펜을 모두 처리한다.
 * - setPointerCapture 이후 e.target 은 항상 컨테이너가 되므로, 좌표는 반드시 산술로 구한다.
 *   getBoundingClientRect 를 매번 새로 읽어서 스크롤 중에도 어긋나지 않게 한다.
 * - pointermove 는 rAF 로 코얼레스한다. 칸이 1000개를 넘어도 60fps 를 유지한다.
 */
export function useDragSelect({ cols, rows, isSelected, onCommit, disabled }) {
  const gridRef = useRef(null)
  const dragRef = useRef(null)
  const rafRef = useRef(0)
  const previewRef = useRef(null)
  const [preview, setPreviewState] = useState(null)

  const cellAt = useCallback(
    (clientX, clientY) => {
      const el = gridRef.current
      if (!el || cols <= 0 || rows <= 0) return null
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null
      const col = Math.floor(((clientX - rect.left) / rect.width) * cols)
      const row = Math.floor(((clientY - rect.top) / rect.height) * rows)
      return { col: clamp(col, 0, cols - 1), row: clamp(row, 0, rows - 1) }
    },
    [cols, rows],
  )

  const rectBetween = (a, b, mode) => ({
    c0: Math.min(a.col, b.col),
    c1: Math.max(a.col, b.col),
    r0: Math.min(a.row, b.row),
    r1: Math.max(a.row, b.row),
    mode,
  })

  const finish = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    const drag = dragRef.current
    const rect = previewRef.current
    dragRef.current = null
    previewRef.current = null
    setPreviewState(null)
    // 부수효과라서 setState 업데이터 안에서 부르지 않는다 (StrictMode 이중 호출 방지)
    if (drag && rect) onCommit(rect)
  }, [onCommit])

  const onPointerDown = (e) => {
    if (disabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const cell = cellAt(e.clientX, e.clientY)
    if (!cell) return
    e.preventDefault()
    try {
      gridRef.current.setPointerCapture(e.pointerId)
    } catch {
      /* 캡처 실패해도 문서 레벨 리스너로 마무리된다 */
    }
    // when2meet 토글 규칙: 시작 칸이 켜져 있으면 지우기, 아니면 칠하기
    const mode = isSelected(cell.col, cell.row) ? 'erase' : 'paint'
    dragRef.current = { anchor: cell, pointerId: e.pointerId, mode }
    const rect = rectBetween(cell, cell, mode)
    previewRef.current = rect
    setPreviewState(rect)
  }

  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    const cell = cellAt(e.clientX, e.clientY)
    if (!cell) return

    // 사각형 자체는 매 이벤트마다 즉시 갱신한다. rAF 는 화면 갱신만 코얼레스한다.
    // 이렇게 해두면 마지막 move 직후 바로 손을 떼도(rAF 가 아직 안 돌았어도)
    // 커밋되는 범위가 실제로 끌어놓은 범위와 어긋나지 않는다.
    previewRef.current = rectBetween(drag.anchor, cell, drag.mode)
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      if (previewRef.current) setPreviewState(previewRef.current)
    })
  }

  const onPointerUp = (e) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    finish()
  }

  // 캡처를 놓치거나 창 밖에서 손을 떼도 드래그가 남지 않게 한다
  useEffect(() => {
    const end = () => {
      if (dragRef.current) finish()
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [finish])

  const previewCovers = useCallback(
    (col, row) =>
      Boolean(
        preview && col >= preview.c0 && col <= preview.c1 && row >= preview.r0 && row <= preview.r1,
      ),
    [preview],
  )

  return {
    gridRef,
    preview,
    previewCovers,
    dragging: Boolean(preview),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onContextMenu: (e) => e.preventDefault(),
    },
  }
}

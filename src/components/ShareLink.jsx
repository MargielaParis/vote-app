import { useToast } from '@/lib/toastContext.js'

export function ShareLink({ url, title }) {
  const toast = useToast()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.show('링크를 복사했습니다.')
    } catch {
      toast.error('복사에 실패했습니다. 주소를 직접 선택해 주세요.')
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: title || '투표', url })
    } catch {
      /* 사용자가 취소했거나 미지원 */
    }
  }

  return (
    <div className="share-box">
      <span className="share-url" title={url}>
        {url}
      </span>
      {typeof navigator !== 'undefined' && navigator.share && (
        <button type="button" className="btn btn--sm" onClick={share}>
          공유
        </button>
      )}
      <button type="button" className="btn btn--sm btn--primary" onClick={copy}>
        복사
      </button>
    </div>
  )
}

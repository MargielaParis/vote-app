export const POLL_TYPE = {
  TEXT: 'text',
  DATE: 'date',
  APPOINTMENT: 'appointment',
}
export const POLL_TYPES = Object.values(POLL_TYPE)

export const POLL_TYPE_LABEL = {
  [POLL_TYPE.TEXT]: '자유 문항',
  [POLL_TYPE.DATE]: '날짜 선택',
  [POLL_TYPE.APPOINTMENT]: '약속 잡기',
}

export const POLL_TYPE_HINT = {
  [POLL_TYPE.TEXT]: '항목을 직접 적습니다. 점심 메뉴, 팀 이름 정하기 등',
  [POLL_TYPE.DATE]: '후보 날짜들을 올려두고 고르게 합니다',
  [POLL_TYPE.APPOINTMENT]: '기간 안에서 각자 가능한 시간을 칠하면 겹치는 시간을 찾아줍니다',
}

export const RESULT_VISIBILITY = {
  AFTER_VOTE: 'after_vote',
  AFTER_DEADLINE: 'after_deadline',
  CREATOR_ONLY: 'creator_only',
}
export const RESULT_VISIBILITIES = Object.values(RESULT_VISIBILITY)

export const RESULT_VISIBILITY_LABEL = {
  [RESULT_VISIBILITY.AFTER_VOTE]: '투표한 뒤에 공개',
  [RESULT_VISIBILITY.AFTER_DEADLINE]: '마감된 뒤에 공개',
  [RESULT_VISIBILITY.CREATOR_ONLY]: '나(생성자)만 보기',
}

export const NAME_DISCLOSURE = {
  FULL: 'full',
  ROSTER: 'roster',
}
export const NAME_DISCLOSURES = Object.values(NAME_DISCLOSURE)

export const NAME_DISCLOSURE_LABEL = {
  [NAME_DISCLOSURE.FULL]: '누가 무엇을 골랐는지 공개',
  [NAME_DISCLOSURE.ROSTER]: '참여자 명단만 공개',
}

export const SLOT_MINUTES_CHOICES = [30, 60]

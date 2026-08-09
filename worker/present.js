/** 비밀번호 해시를 절대 내보내지 않는다. */
export function publicPoll(poll) {
  return {
    id: poll.id,
    rev: poll.rev,
    title: poll.title,
    description: poll.description,
    pollType: poll.pollType,
    anonymous: poll.anonymous,
    multiSelect: poll.multiSelect,
    allowRevote: poll.allowRevote,
    resultVisibility: poll.resultVisibility,
    nameDisclosure: poll.nameDisclosure,
    deadline: poll.deadline,
    closed: Date.now() > poll.deadline,
    options: poll.options || null,
    appointment: poll.appointment || null,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
  }
}

export function publicBallot(record) {
  if (!record) return null
  return {
    voterKey: record.voterKey,
    name: record.name || null,
    choices: record.choices || null,
    slots: record.masks ? record.masks : null,
    updatedAt: record.updatedAt,
  }
}

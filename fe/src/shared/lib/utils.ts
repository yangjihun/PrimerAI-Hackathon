/**
 * 밀리초를 시:분:초 형식으로 변환
 */
export function msToClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  
  if (hours > 0) {
    return `${hours}:${minutes}:${seconds}`;
  }
  return `${minutes}:${seconds}`;
}

/**
 * 신뢰도 레벨 텍스트 변환
 */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return "높음";
  if (confidence >= 0.45) return "중간";
  return "낮음";
}

/**
 * 관계 타입 한글 변환
 */
export function relationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    FAMILY: "가족",
    ROMANCE: "연인",
    ALLY: "동맹",
    MISTRUST: "불신",
    BOSS_SUBORDINATE: "상사-부하",
    FRIEND: "친구",
    RIVAL: "라이벌",
    UNKNOWN: "미확인",
  };
  return labels[type] || type;
}


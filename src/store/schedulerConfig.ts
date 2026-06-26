/** スケジューラーの再割り当て間隔（時間） */
export const SCHEDULER_INTERVAL_HOURS = 4;

/** 同一モンスターに割り当てる最大討伐村人数 (自動パーティー機能では PARTY_SIZE を使用) */
export const MAX_HUNTERS_PER_MONSTER = 2;

/** 同一採取ポイントに割り当てる最大採取村人数 */
export const MAX_GATHERERS_PER_RESOURCE = 2;

/** スケジューラーで村人が割り当てられなかった場合のフォールバック閾値比 */
export const MAX_ASSIGNMENT_RATIO = 1.5;

/** 自動パーティーの最大メンバー数 (1 = 機能オフ) */
export const PARTY_SIZE = 3;

/** 同一エリア内パーティ間の開始時間差 (時間単位) */
export const PARTY_STAGGER_HOURS = 1;

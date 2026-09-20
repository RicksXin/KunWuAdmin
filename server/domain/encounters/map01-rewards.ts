/** 2026-09-18 user override; equipment runtime validated locally; channel publication is separate. */
export const map01BossEquipmentRewards = {
  schemaVersion: 1,
  encounterCode: "enc_b1_gate_stone",
  firstClearOnly: true,
  equipment: [{qualityCode:"fa_qi",quantity:1},{qualityCode:"zhen_bao",quantity:1}],
  implementationStatus: "development_runtime_ready",
  source: "用户确认：地图1Boss首杀法器一件、真宝一件；替代精制/上品",
} as const;

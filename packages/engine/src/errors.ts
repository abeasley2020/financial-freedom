/** Why the reducer rejected an action. A rejection never changes state and is never logged. */
export type EngineError =
  | 'NOT_YOUR_TURN'
  | 'INVALID_FOR_PENDING'
  | 'INSUFFICIENT_CASH'
  | 'GAME_NOT_PLAYING'
  | 'ALREADY_ROLLED'
  | 'MUST_ROLL_FIRST'
  | 'NOT_IMPLEMENTED';

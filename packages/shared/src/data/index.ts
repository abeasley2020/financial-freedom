// Profession, card, and board fixtures, validated with Zod at module load
// (CLAUDE.md, Layout). A bad fixture throws here, at import time, so no game
// can start on invalid data.

import { BoardSchema, type Board } from '../board';
import {
  CardSchema,
  DealCardSchema,
  LifeChoicesCardSchema,
  MarketCardSchema,
  SetbackCardSchema,
  type Card,
  type DealCard,
  type DeckId,
  type LifeChoicesCard,
  type MarketCard,
  type SetbackCard,
} from '../cards';
import { ProfessionSchema, type Profession } from '../professions';
import rawBoard from './board.json';
import rawBigDeals from './cards/big-deals.json';
import rawLifeChoices from './cards/life-choices.json';
import rawMarket from './cards/market.json';
import rawSetback from './cards/setback.json';
import rawSmallDeals from './cards/small-deals.json';
import rawProfessions from './professions.json';

export const PROFESSIONS: readonly Profession[] = ProfessionSchema.array().parse(rawProfessions);

export const SMALL_DEALS: readonly DealCard[] = DealCardSchema.array().parse(rawSmallDeals);
export const BIG_DEALS: readonly DealCard[] = DealCardSchema.array().parse(rawBigDeals);
export const MARKET_CARDS: readonly MarketCard[] = MarketCardSchema.array().parse(rawMarket);
export const LIFE_CHOICES_CARDS: readonly LifeChoicesCard[] = LifeChoicesCardSchema.array().parse(rawLifeChoices);
export const SETBACK_CARDS: readonly SetbackCard[] = SetbackCardSchema.array().parse(rawSetback);

export const CARDS_BY_DECK: Readonly<Record<DeckId, readonly Card[]>> = {
  smallDeals: SMALL_DEALS,
  bigDeals: BIG_DEALS,
  market: MARKET_CARDS,
  lifeChoices: LIFE_CHOICES_CARDS,
  setback: SETBACK_CARDS,
};

/** Every card from every deck, keyed by id. Ids are unique across decks. */
export const CARDS_BY_ID: ReadonlyMap<string, Card> = new Map(
  Object.values(CARDS_BY_DECK)
    .flat()
    .map((card) => [card.id, CardSchema.parse(card)]),
);

export const BOARD: Board = BoardSchema.parse(rawBoard);

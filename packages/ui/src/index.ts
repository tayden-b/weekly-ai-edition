/**
 * @weekly/ui — design tokens (DESIGN §1) and the §4 primitives.
 * Stylesheets: `@weekly/ui/tokens.css` (custom properties, both schemes),
 * `@weekly/ui/fonts.css` (@font-face), `@weekly/ui/components.css` (the .w-*
 * classes below). apps/web imports all three once.
 */

export {
  colors,
  type ColorScheme,
  type ColorToken,
  fonts,
  type FontRole,
  typeScale,
  type TypeToken,
  leading,
  measure,
  space,
  type SpaceStep,
  grid,
  radius,
  motion,
} from "./tokens";
export {
  type SourceView,
  type ItemView,
  type IssueMetaView,
  type TickerView,
  type ChartSeriesView,
  type CoveredRowView,
  type AgentLink,
} from "./types";

export { Rule } from "./components/Rule";
export { Kicker } from "./components/Kicker";
export { IssueMeta } from "./components/IssueMeta";
export { Masthead } from "./components/Masthead";
export { SectionHead } from "./components/SectionHead";
export { Item } from "./components/Item";
export { ItemList } from "./components/ItemList";
export { Pill } from "./components/Pill";
export { MonoTable, type MonoTableColumn } from "./components/MonoTable";
export { TrendDelta, TrendArrow } from "./components/TrendDelta";
export { ProgressSegments } from "./components/ProgressSegments";
export { DeckCard } from "./components/DeckCard";
export { Deck } from "./components/Deck";
export {
  FrontPage,
  type FrontPageCover,
  type FrontPageSection,
  type FrontPageMarkets,
  type FrontPageBackPage,
} from "./components/FrontPage";
export { CoverImage } from "./components/CoverImage";
export { LineChart } from "./components/LineChart";
export { AgentAccess } from "./components/AgentAccess";
export { OgCard } from "./components/OgCard";

import { common, enums, regions, status } from "./common";
import { account } from "./account";
import { auctions } from "./auctions";
import { auth } from "./auth";
import { home } from "./home";
import { layout } from "./layout";
import { tools } from "./tools";
import { workspace } from "./workspace";

/** Every namespace, each holding `en` and `am` dictionaries of the same shape. */
export const messages = {
  common,
  status,
  enums,
  regions,
  layout,
  home,
  auctions,
  auth,
  workspace,
  account,
  tools,
};

export type Namespace = keyof typeof messages;

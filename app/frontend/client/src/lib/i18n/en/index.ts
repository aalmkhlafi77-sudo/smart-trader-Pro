import dict_access from "./access";
import dict_backup from "./backup";
import dict_cargo from "./cargo";
import dict_common_1 from "./common-1";
import dict_common_2 from "./common-2";
import dict_entities from "./entities";
import dict_export from "./export";
import dict_followup from "./followup";
import dict_home from "./home";
import dict_items from "./items";
import dict_multiCalc from "./multiCalc";
import dict_nav from "./nav";
import dict_prices from "./prices";
import dict_reports from "./reports";
import dict_settings from "./settings";
import dict_ui from "./ui";

const merged: Record<string, string> = {
  ...dict_access,
  ...dict_backup,
  ...dict_cargo,
  ...dict_common_1,
  ...dict_common_2,
  ...dict_entities,
  ...dict_export,
  ...dict_followup,
  ...dict_home,
  ...dict_items,
  ...dict_multiCalc,
  ...dict_nav,
  ...dict_prices,
  ...dict_reports,
  ...dict_settings,
  ...dict_ui,
};

export default merged;

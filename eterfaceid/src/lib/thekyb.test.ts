import assert from "node:assert/strict";
import {
  mapAmlCategory,
  ownersFromTheKybProfile,
  registryCheckResult,
  summariseAmlHits,
  toTheKybCountryCode,
  toTheKybCountryName,
} from "./thekyb.ts";

assert.equal(toTheKybCountryCode("CA"), "CA");
assert.equal(toTheKybCountryCode("uk"), "GB");
assert.equal(toTheKybCountryCode("united kingdom"), "GB");
assert.equal(toTheKybCountryCode("us_oh"), "US_OH");
assert.equal(toTheKybCountryName("CA"), "canada");
assert.equal(toTheKybCountryName("GB"), "united_kingdom");

assert.equal(registryCheckResult("active", "verified"), "pass");
assert.equal(registryCheckResult("dissolved", "verified"), "fail");
assert.equal(registryCheckResult("unknown", "unknown"), "review");

assert.equal(mapAmlCategory("Sanctions"), "sanctions");
assert.equal(mapAmlCategory("PEP Level 1"), "pep");
assert.equal(mapAmlCategory("Adverse Media"), "adverse_media");
assert.equal(mapAmlCategory("Insolvency"), "watchlist");

const owners = ownersFromTheKybProfile({
  beneficial_owners_detail: [
    {
      name: "Jordan Owner",
      designation: "Beneficial owner",
      nationality: "CA",
      shares_detail: { ownership_min_shares: 40, ownership_max_shares: 40 },
    },
  ],
  people_detail: [{ name: "Alex Reviewer", designation: "Director", nationality: "CA" }],
  parent_companies: [{ name: "Holdco Ltd", country_name: "canada" }],
});
assert.equal(owners.length, 3);
assert.equal(owners[0]?.is_ubo, true);
assert.equal(owners[0]?.ownership_pct, 40);
assert.equal(owners[1]?.control_role, "Director");
assert.equal(owners[2]?.entity_type, "business");

const hits = summariseAmlHits(
  [
    {
      name: "ACME",
      categories: ["Sanctions"],
      countries: ["canada"],
      matched_names: [{ matched_name: "ACME INC", score: "94" }],
    },
  ],
  "potential match",
);
assert.equal(hits[0]?.match_score, 0.94);
assert.equal(hits[0]?.name, "ACME");

console.log("thekyb helpers: all assertions passed");

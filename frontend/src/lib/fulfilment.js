export const FULFILMENT_OPTIONS = [
  { value: "self_collect", label: "I will collect from the shop" },
  { value: "authorised_collector", label: "An authorised person will collect" },
  { value: "local_delivery", label: "Local delivery in Nepal" },
  { value: "traveller_collect", label: "A traveller will collect" },
  { value: "international_shipping", label: "Discuss overseas delivery" },
];

export const COUNTRY_OPTIONS = [
  { value: "NP", label: "Nepal" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
];

export const COLLECTOR_METHODS = new Set(["authorised_collector", "traveller_collect"]);

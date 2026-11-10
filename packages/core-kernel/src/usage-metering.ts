/** Measurement vocabulary only. No prices, invoices, payment processing or entitlement decisions live here. */
export type UsageAggregation = "sum" | "max" | "last" | "distinct";
export type UsageMeterDefinition = Readonly<{
  id: string;
  moduleId: string;
  unit: string;
  aggregation: UsageAggregation;
  description: string;
  /** Stable, reviewed source identifier, e.g. 'whatsapp.outbound.confirmed'. */
  source: string;
}>;
export type UsageEvent = Readonly<{
  eventId: string;
  tenantId: string;
  meterId: string;
  occurredAt: string;
  quantity: number;
  /** Source idempotency key; retries must not create extra billable usage. */
  sourceEventId: string;
}>;
const ID=/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const UNIT=/^[a-z][a-z0-9_]*$/;
const AGGREGATIONS=new Set<UsageAggregation>(["sum","max","last","distinct"]);

/** Validates publisher-owned metadata; never accepts this descriptor from an HTTP client. */
export function defineUsageMeter(definition: UsageMeterDefinition): Readonly<UsageMeterDefinition> {
  if(!definition || !ID.test(definition.id) || !ID.test(definition.moduleId) ||
    !definition.id.startsWith(definition.moduleId + ".") ||
    !UNIT.test(definition.unit) || !ID.test(definition.source) ||
    !AGGREGATIONS.has(definition.aggregation) ||
    typeof definition.description!=="string" || definition.description.trim().length===0 ||
    definition.description.length>256) {
    throw new Error("Invalid usage meter definition");
  }
  return Object.freeze({...definition});
}

/** Event shape validation is intentionally narrow. Storage, deduplication and billing remain separate. */
export function validateUsageEvent(event:UsageEvent):Readonly<UsageEvent> {
  if(!event || !event.eventId?.trim() || !event.tenantId?.trim() ||
    !ID.test(event.meterId) || !event.sourceEventId?.trim() ||
    !Number.isSafeInteger(event.quantity) || event.quantity<0 ||
    typeof event.occurredAt!=="string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(event.occurredAt) ||
    !Number.isFinite(Date.parse(event.occurredAt))) {
    throw new Error("Invalid usage event");
  }
  return Object.freeze({...event});
}

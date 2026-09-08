import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Props for {@link DynamoDbTable}.
 *
 * Accepts the full CDK `dynamodb.TableProps` so any component can configure the
 * table however it needs. The construct merges these over a small opinionated
 * base (see {@link DynamoDbTable.DEFAULTS}) so callers get consistent, safe
 * defaults for free while retaining the ability to override any field.
 *
 * `partitionKey` is the only required field — a table cannot exist without one,
 * and there is no sensible default for it.
 */
export interface DynamoDbTableProps extends dynamodb.TableProps {}

/**
 * A DynamoDB table with defaults-with-override configuration.
 *
 * This is a resource-level construct, not a use-case one: it does not assume
 * anything about what the table stores. Every field is overridable by the
 * consuming stack; the construct only supplies house defaults (on-demand
 * billing, point-in-time recovery, retain-on-delete) that any caller can
 * replace.
 */
export class DynamoDbTable extends Construct {
  /** House defaults merged under caller-supplied props. */
  static readonly DEFAULTS = {
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  } satisfies Partial<dynamodb.TableProps>;

  readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoDbTableProps) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'Resource', {
      ...DynamoDbTable.DEFAULTS,
      ...props,
    });
  }

  /** Convenience passthrough to the underlying table name. */
  get tableName(): string {
    return this.table.tableName;
  }
}

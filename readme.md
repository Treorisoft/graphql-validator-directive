# @treorisoft/graphql-validator-directive

Allows creating custom constraint directives to validate queries and inputs. Inspired by [graphql-constraint-directive](https://github.com/confuser/graphql-constraint-directive).

This is useful for output types as well - since this consolidates directives rather than relying on individual field resolvers which might have the directive run the same validation check multiple times.

## Setup

There are multiple parts to setup and use this.

### Create Directives

First create the custom directives and ensure they are part of your schema.

Currently the only supported directive locations: `FIELD_DEFINITION` | `INPUT_FIELD_DEFINITION` | `ARGUMENT_DEFINITION`

```gql
directive @isAuthenticated(message: String) on FIELD | FIELD_DEFINITION | INPUT_FIELD_DEFINITION
```

### Create Rule

Next create the rule that will handle the directive. See the [Usage](#usage) section for further details.

```ts
import { ValidationDirectiveRule } from "@treorisoft/graphql-validator-directive";

export default class IsAuthenticatedDirectiveRule extends ValidationDirectiveRule<Record<string, any>, any, unknown> {
  async execute(context: unknown): Promise<void> {
    if (!context.auth) {
      throw new Error('Not authorized: ' + this.args.message);
    }
  }  
}
```

### Register Rule/Transform Schema

Now we need to register the rule with the directive and transform the schema to initialize them.

```ts
import { schemaTransformer, registerRules } from '@treorisoft/graphql-validator-directive';
import IsAuthenticatedDirectiveRule from './directives/isAuthenticatedRule';

registerRules({
  isAuthenticated: IsAuthenticatedDirectiveRule,
});

export function mergeDirectives(schema: GraphQLSchema): GraphQLSchema {
  return schemaTransformer(schema);
}
```

### Setup the plugin

```ts
import { createApolloValidationPlugin } from '@treorisoft/graphql-validator-directive';

const server = new ApolloServer<ResolverContext>({
  schema,
  plugins: [
    createApolloValidationPlugin(),
  ]
});
```

## Usage

`execute` is a required abstract method that performs the validation for the given field and receives the same `context` that would be passed to any field resolver.

There are 3 ways to signal an failure.

Return a boolean `false`, return a `string` with the error message or simply throw an error.

Depending on just what kind of validation is taking place the effect of the failure will be different.

- Input validation, or top-level query/mutation fields will cause an error to be thrown.
- Type field validation:
  - If your rule throws, it will be thrown before anything is run
  - If you return a failure (`false` or `string`), your field will be _removed_ from the selection set and pretend that it wasn't even requested.

## Development

Development of this package is done via a larger monorepo where this is a git submodule.
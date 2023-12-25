import { Path as BasePath, Maybe, pathToArray, printPathArray } from '@graphql-tools/utils';

export interface Path extends BasePath {
  readonly prev: BasePath | Path | undefined
  readonly is_input: boolean | undefined
}

export function addPath(prev: Readonly<Path> | Readonly<BasePath> | undefined, key: string | number, typename: string | undefined, is_input: boolean | undefined): Path {
  return { prev, key, typename, is_input };
}

export function pathHasInput(path: Maybe<Readonly<Path | BasePath>>): boolean {
  let curr = path as Maybe<Readonly<Path>>;
  while (curr) {
    if (typeof curr.is_input != 'undefined') {
      return true;
    }
    curr = curr.prev as Maybe<Readonly<Path>>;
  }
  return false;
}

export function printPath(path: Readonly<Path>): string {
  let pathArr = pathToArray(path);
  let pathStr = printPathArray(pathArr);
  return pathStr.trimStart().replace(/^\./, '');
}
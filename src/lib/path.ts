import { Path as BasePath, Maybe, pathToArray, printPathArray } from '@graphql-tools/utils';

export interface Path extends BasePath {
  readonly prev: BasePath | Path | undefined
  readonly is_input: boolean | undefined
  readonly skipped: boolean | undefined
}

interface PathOptions {
  key: string | number
  typename?: string
  is_input?: boolean
  skipped?: boolean
}

export function addPath(prev: Readonly<Path> | Readonly<BasePath> | undefined, { key, typename, is_input, skipped }: PathOptions): Path {
  return { prev, key, typename, is_input, skipped };
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

export function pathHasSkip(path: Maybe<Readonly<Path | BasePath>>): boolean {
  let curr = path as Maybe<Readonly<Path>>;
  while (curr) {
    if (!!curr.skipped) {
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

export function replaceRoot(path: Readonly<Path>, newRoot: Readonly<Path>): Path {
  let pathArr = pathObjectArray(path);
  let rootPath = pathObjectArray(newRoot);
  let newPathArr = [...rootPath, ...pathArr];
  let newPath = newPathArr.reduce((acc, { prev, ...rest }) => {
    return addPath(acc, rest);
  }, undefined as (Readonly<Path> | undefined));
  return newPath!;
}

function pathObjectArray(path: Readonly<Path>): Array<Path> {
  let arr: Array<Path> = [];
  let curr: Maybe<Readonly<Path>> = path;
  while (curr) {
    arr.push(curr);
    curr = curr.prev as Maybe<Readonly<Path>>;
  }
  return arr.reverse();
}
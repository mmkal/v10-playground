import { TRPC_ERROR_CODE_KEY } from './rpc';

const middlewareMarker = Symbol('middlewareMarker');
///////////// utils //////////////

export type MaybePromise<T> = T | Promise<T>;
/**
 * JSON-RPC 2.0 Error codes
 *
 * `-32000` to `-32099` are reserved for implementation-defined server-errors.
 * For tRPC we're copying the last digits of HTTP 4XX errors.
 */
//////// response shapes //////////
export interface ProcedureResultSuccess {
  data?: unknown;
}
export interface ResultErrorData {
  code: TRPC_ERROR_CODE_KEY;
  cause?: Error;
}
export interface ProcedureResultError {
  error: ResultErrorData;
}
export type ProcedureResult = ProcedureResultSuccess | ProcedureResultError;
///////// middleware implementation ///////////
interface MiddlewareResultBase<TParams> {
  /**
   * All middlewares should pass through their `next()`'s output.
   * Requiring this marker makes sure that can't be forgotten at compile-time.
   */
  readonly marker: typeof middlewareMarker;
  TParams: TParams;
}
export interface MiddlewareOKResult<TParams>
  extends MiddlewareResultBase<TParams>,
    ProcedureResultSuccess {}
export interface MiddlewareErrorResult<TParams>
  extends MiddlewareResultBase<TParams>,
    ProcedureResultError {}
export type MiddlewareResult<TParams> =
  | MiddlewareOKResult<TParams>
  | MiddlewareErrorResult<TParams>;
export type MiddlewareFunctionParams<TInputParams> = TInputParams & {
  next: {
    (): Promise<MiddlewareResult<TInputParams>>;
    <T>(params: T): Promise<MiddlewareResult<T>>;
  };
};
export type MiddlewareFunction<
  TInputParams,
  TNextParams,
  TResult extends ProcedureResult = never,
> = (
  params: MiddlewareFunctionParams<TInputParams>,
) => Promise<MiddlewareResult<TNextParams> | TResult> | TResult;
type Resolver<TParams, TResult extends ProcedureResult> = (
  params: TParams,
) => MaybePromise<TResult>;
export interface Params<TContext> {
  ctx: TContext;
  rawInput?: unknown;
}
type ExcludeMiddlewareResult<T> = T extends MiddlewareResult<any> ? never : T;
export type ProcedureCall<TBaseParams, TResult extends ProcedureResult> = (
  params: TBaseParams,
) => MaybePromise<TResult>;
type ProcedureMeta<TParams> = {
  /**
   * @internal
   */
  _params: TParams;
};
export type ProcedureCallWithMeta<TBaseParams, TParams, TResult> =
  ProcedureCall<TBaseParams, TResult> & ProcedureMeta<TParams>;
// interface Procedure<TBaseParams, ResolverParams, ResolverResult> {
//   /**
//    * @internal
//    * @deprecated
//    */
//   _params: ResolverParams;
//   call(params: TBaseParams): MaybePromise<ResolverResult>;
// }
export function pipedResolver<TContext>() {
  type TBaseParams = Params<TContext>;

  function middlewares<TResult extends ProcedureResult>(
    resolver: Resolver<TBaseParams, TResult>,
  ): ProcedureCallWithMeta<TBaseParams, TBaseParams, TResult>;
  function middlewares<
    TResult extends ProcedureResult,
    MW1Params extends TBaseParams = TBaseParams,
    MW1Result extends ProcedureResult = never,
  >(
    middleware1: MiddlewareFunction<TBaseParams, MW1Params, MW1Result>,
    resolver: Resolver<MW1Params, TResult>,
  ): ProcedureCallWithMeta<
    TBaseParams,
    MW1Params,
    ExcludeMiddlewareResult<TResult | MW1Result>
  >;
  function middlewares<
    TResult extends ProcedureResult,
    MW1Params extends TBaseParams = TBaseParams,
    MW1Result extends ProcedureResult = never,
    MW2Params extends TBaseParams = MW1Params,
    MW2Result extends ProcedureResult = never,
  >(
    middleware1: MiddlewareFunction<TBaseParams, MW1Params, MW1Result>,
    middleware2: MiddlewareFunction<MW1Params, MW2Params, MW2Result>,
    resolver: Resolver<MW2Params, TResult>,
  ): ProcedureCallWithMeta<
    TBaseParams,
    MW2Params,
    ExcludeMiddlewareResult<TResult | MW1Result | MW2Result>
  >;
  function middlewares(...args: any): any {
    throw new Error('Unimplemented');
  }

  return middlewares;
}

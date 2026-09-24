/**
 * 关卡达成时抛出的停止信号。
 *
 * 解释器是递归执行的，普通的 return 只能退出当前一层；
 * 用抛异常的方式可以把整个调用栈一次性掀掉，
 * 保证「最后一株小麦收获」之后不会再多走一步。
 */
export class HaltSignal extends Error {
  constructor(payload = {}) {
    super('关卡完成');
    this.name = 'HaltSignal';
    this.payload = payload;
  }
}

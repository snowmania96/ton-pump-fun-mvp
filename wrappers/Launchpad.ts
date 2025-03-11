import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type LaunchpadConfig = {
    counter: number;
    id: number;
};

export function launchpadConfigToCell(config: LaunchpadConfig): Cell {
    return beginCell().storeUint(config.counter, 32).storeUint(config.id, 32).endCell();
}

export class Launchpad implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new Launchpad(address);
    }

    static createFromConfig(config: LaunchpadConfig, code: Cell, workchain = 0) {
        const data = launchpadConfigToCell(config);
        const init = { code, data };
        return new Launchpad(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendIncrement(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(1, 32).endCell(),
        });
    }

    async getCounter(provider: ContractProvider) {
        const result = await provider.get('get_counter', []);
        return result.stack.readNumber();
    }

    async getId(provider: ContractProvider) {
        const result = await provider.get('get_id', []);
        return result.stack.readNumber();
    }
}

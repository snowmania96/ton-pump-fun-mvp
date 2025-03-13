import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode,
    toNano,
} from '@ton/core';

import { Op } from './Constants';

import { Sha256 } from '@aws-crypto/sha256-js';

import * as minterdata from '../build/JettonMinter.compiled.json';

export const JETTON_MINTER_CODE = Cell.fromBoc(Buffer.from(minterdata.hex, 'hex'))[0];
import { buildTokenMetadataCell } from './JettonMinter';

const sha256 = (str: string) => {
    const sha = new Sha256();
    sha.update(str);
    return Buffer.from(sha.digestSync());
};

export function launchpadConfigToCell(admin: Address): Cell {
    return beginCell().storeAddress(admin).storeRef(JETTON_MINTER_CODE).storeRef(beginCell().endCell()).endCell();
}

export type JettonMinterContent = {
    name: string;
    symbol: string;
    image: string;
    description: string;
};

export class Launchpad implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new Launchpad(address);
    }

    static createFromConfig(admin: Address, code: Cell, workchain = 0) {
        const data = launchpadConfigToCell(admin);
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

    async getMinterAddress(provider: ContractProvider, content: JettonMinterContent): Promise<Address> {
        const res = await provider.get('get_minter_address', [
            {
                type: 'cell',
                cell: buildTokenMetadataCell({
                    name: content.name,
                    symbol: content.symbol,
                    image: content.image,
                    description: content.description,
                }),
            },
        ]);
        return res.stack.readAddress();
    }

    async getLaunchpadData(provider: ContractProvider) {
        let res = await provider.get('get_launchpad_data', []);
        let adminAddress = res.stack.readAddress();
        let minterCode = res.stack.readCell();
        let deployedTokens = res.stack.readCell();

        return {
            adminAddress,
            minterCode,
            deployedTokens,
        };
    }

    async sendCreateToken(
        provider: ContractProvider,
        via: Sender,
        to: Address,
        jetton_amount: bigint,
        forward_ton_amount: bigint,
        total_ton_amount: bigint,
        content: JettonMinterContent,
    ) {
        if (total_ton_amount <= forward_ton_amount) {
            throw new Error('Total ton amount should be > forward amount');
        }
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Launchpad.createMessage(
                this.address,
                to,
                jetton_amount,
                forward_ton_amount,
                total_ton_amount,
                content,
            ),
            value: total_ton_amount + toNano('0.015'),
        });
    }

    static createMessage(
        admin: Address,
        to: Address,
        jetton_amount: bigint,
        forward_ton_amount: bigint,
        total_ton_amount: bigint,
        content: JettonMinterContent,
        query_id: number | bigint = 0,
    ) {
        const mintMsg = beginCell()
            .storeUint(Op.internal_transfer, 32)
            .storeUint(0, 64)
            .storeCoins(jetton_amount)
            .storeAddress(null)
            .storeAddress(to) // Response addr
            .storeCoins(forward_ton_amount)
            .storeMaybeRef(null)
            .endCell();

        const createMsg = beginCell()
            .storeUint(Op.mint, 32)
            .storeUint(query_id, 64) // op, queryId
            .storeAddress(admin)
            .storeCoins(total_ton_amount)
            .storeRef(mintMsg)
            .endCell();

        return beginCell()
            .storeUint(Op.create_token, 32)
            .storeUint(query_id, 64) // op, queryId
            .storeCoins(total_ton_amount)
            .storeCoins(jetton_amount)
            .storeRef(buildTokenMetadataCell(content))
            .storeRef(createMsg)
            .endCell();
    }
}

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Launchpad } from '../wrappers/Launchpad';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Launchpad', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Launchpad');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let launchpad: SandboxContract<Launchpad>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        launchpad = blockchain.openContract(Launchpad.createFromConfig({ counter: 0, id: 0 }, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await launchpad.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: launchpad.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and launchpad are ready to use
    });
});

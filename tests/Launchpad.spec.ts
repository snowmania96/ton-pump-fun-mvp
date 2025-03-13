import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { Launchpad } from '../wrappers/Launchpad';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonWallet } from '../wrappers/JettonWallet';
import { JettonMinter } from '../wrappers/JettonMinter';

export type JettonMinterContent = {
    name: string;
    symbol: string;
    image: string;
    description: string;
};

describe('Launchpad', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Launchpad');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let launchpad: SandboxContract<Launchpad>;
    let userWallet: any;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');

        launchpad = blockchain.openContract(Launchpad.createFromConfig(deployer.address, code));

        const deployResult = await launchpad.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: launchpad.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        console.log('Deployer address: ', deployer.address);
        console.log('Launchpad address: ', launchpad.address);
    });

    it('Should create a new token', async () => {
        let content = {
            name: 'My Jetton',
            symbol: 'JETT',
            image: 'https://bitcoin.org/img/icons/logotop.svg',
            description: 'My first jetton',
        };

        const deployedJettonMinterAddress = await launchpad.getMinterAddress(content);
        let initialJettonBalance = toNano('1000.23');
        const createResult = await launchpad.sendCreateToken(
            deployer.getSender(),
            deployedJettonMinterAddress,
            initialJettonBalance,
            toNano('0.05'),
            toNano('1'),
            content,
        );
        console.log('Deployed jetton minter contract address: ', deployedJettonMinterAddress);
        console.log('Launchpad data: ', await launchpad.getLaunchpadData());

        const jettonMinter = blockchain.openContract(JettonMinter.createFromAddress(deployedJettonMinterAddress));
        console.log(jettonMinter);
        userWallet = async (address: Address) =>
            blockchain.openContract(JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(address)));
        const deployerJettonWallet = await userWallet(launchpad.address);
        console.log(deployerJettonWallet);
        console.log(await deployerJettonWallet.getJettonBalance());
    });
});

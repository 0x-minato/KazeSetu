// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import { IClVaultEvents } from "./IClVaultEvents.sol";
import { IClVaultActions } from "./IClVaultActions.sol";

interface IKazeClVault is 
    IClVaultEvents,
    IClVaultActions
{

}
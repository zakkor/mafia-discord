import { RoleType } from './role'

export interface RoleConfig {
  id: string
  type: RoleType
  isNightRole: boolean
  channelID: string
  maximumAssigned: number
}

interface GameConfig {
  roles: RoleConfig[]
}

export const gameConfigInstance: GameConfig = {
  roles: [
    {
      id: '490567542398648320',
      type: RoleType.None,
      channelID: '489106226244878340',
      isNightRole: false, // will not be randomly assigned to players at the start
      maximumAssigned: -1
    },
    {
      id: '490609185524809729',
      type: RoleType.Day,
      channelID: '489727884634619904',
      isNightRole: false,
      maximumAssigned: 4
    },
    {
      id: '489106307832610836',
      type: RoleType.Villager,
      channelID: '489727930679689216',
      isNightRole: true,
      maximumAssigned: 1
    },
    {
      id: '489106278237601792',
      type: RoleType.Mafia,
      channelID: '489727867005960194',
      isNightRole: true,
      maximumAssigned: 1
    },
    {
      id: '489520383511363606',
      type: RoleType.Cop,
      channelID: '489727972274601994',
      isNightRole: true,
      maximumAssigned: 1
    },
    {
      id: '489520463546941452',
      type: RoleType.Doctor,
      channelID: '489727998640259095',
      isNightRole: true,
      maximumAssigned: 1
    },
  ]
}
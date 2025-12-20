
export interface PresetUser {
    id: string;
    username: string;
    displayName: string;
    pfpUrl: string;
}

export const USER_PRESETS: PresetUser[] = [
    {
        id: 'jesse',
        username: 'jessepollak',
        displayName: 'Jesse Pollak',
        pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/6a45e644-86a9-4562-cc01-7a1957a52f00/rectcrop3'
    },
    {
        id: 'dwr',
        username: 'dwr.eth',
        displayName: 'Dan Romero',
        pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/63c0b18e-04c7-4989-1e5e-5c5c6d8d3800/rectcrop3'
    },
    {
        id: 'vitalik',
        username: 'vitalik.eth',
        displayName: 'Vitalik Buterin',
        pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/d086a788-ce0c-4c14-8f8b-d19af82c8c00/rectcrop3'
    },
    {
        id: 'brian',
        username: 'barmstrong',
        displayName: 'Brian Armstrong',
        pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/9a0f4f24-e16b-4cc9-5a64-e9a2a9c5ec00/rectcrop3'
    },
    {
        id: 'clanker',
        username: 'clanker',
        displayName: 'Clanker',
        pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/a1c0c3c8-40b8-40f8-d832-cbb19c7a9200/rectcrop3'
    }
];


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
        pfpUrl: 'https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_168/https%3A%2F%2Flh3.googleusercontent.com%2F-S5cdhOpZtJ_Q%2FAAAAAAAAAAI%2FAAAAAAAAAAA%2FACHi3rdJjYF_k_Z5_r_t_t_t_t_t_t_t_t_t%2Fphoto.jpg%3Fsz%3D48'
    },
    {
        id: 'dwr',
        username: 'dwr',
        displayName: 'Dan Romero',
        pfpUrl: 'https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_168/https%3A%2F%2Flh3.googleusercontent.com%2F-S5cdhOpZtJ_Q%2FAAAAAAAAAAI%2FAAAAAAAAAAA%2FACHi3rdJjYF_k_Z5_r_t_t_t_t_t_t_t_t_t%2Fphoto.jpg%3Fsz%3D48'
    },
    {
        id: 'vitalik',
        username: 'vitalik.eth',
        displayName: 'Vitalik Buterin',
        pfpUrl: 'https://i.imgur.com/not_real.png'
    },
    {
        id: 'brian',
        username: 'brian_armstrong',
        displayName: 'Brian Armstrong',
        pfpUrl: 'https://i.imgur.com/not_real.png'
    }
];

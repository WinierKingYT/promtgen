export const ARTIFACT_DEPENDENCIES = {
    profile: [
        'mvpScope',
        'requirements',
        'technology',
        'architecture',
        'tasks',
        'finalReview'
    ],
    mvpScope: [
        'requirements',
        'technology',
        'architecture',
        'tasks',
        'finalReview'
    ],
    requirements: [
        'technology',
        'architecture',
        'tasks',
        'finalReview'
    ],
    technology: [
        'architecture',
        'tasks',
        'finalReview'
    ],
    architecture: [
        'tasks',
        'finalReview'
    ],
    tasks: [
        'finalReview'
    ]
};

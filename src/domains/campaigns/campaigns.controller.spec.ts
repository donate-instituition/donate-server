import { CampaignsController } from './campaigns.controller';

function createCampaignsServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'created' }),
    createForCurrentInstitution: jest
      .fn()
      .mockResolvedValue({ id: 'created-mine' }),
    publishForCurrentInstitution: jest
      .fn()
      .mockResolvedValue({ id: 'published' }),
    createComment: jest.fn().mockResolvedValue({ id: 'comment-1' }),
    listComments: jest.fn().mockResolvedValue([{ id: 'comment-1' }]),
    getRecentDonors: jest
      .fn()
      .mockResolvedValue({ donors: [], totalCount: 0 }),
    like: jest.fn().mockResolvedValue({ campaignId: '1', liked: true }),
    unlike: jest.fn().mockResolvedValue({ campaignId: '1', liked: false }),
    share: jest.fn().mockResolvedValue({ campaignId: '1', sharesCount: 1 }),
    findAll: jest.fn().mockResolvedValue([{ id: '1' }]),
    findMine: jest.fn().mockResolvedValue([{ id: 'mine-1' }]),
    getMyLikedCampaignIds: jest.fn().mockResolvedValue(['1', '2']),
    findOne: jest.fn().mockResolvedValue({ id: '1' }),
    update: jest.fn().mockResolvedValue({ id: '1', title: 'updated' }),
    remove: jest.fn().mockResolvedValue({ id: '1' }),
  };
}

describe('CampaignsController', () => {
  function createController() {
    const campaignsService = createCampaignsServiceMock();
    const controller = new CampaignsController(campaignsService as any);
    return { controller, campaignsService };
  }

  const user = { sub: 'user-1' } as any;

  it('create() delegates to campaignsService.create with the dto', async () => {
    const { controller, campaignsService } = createController();
    const dto = { title: 'x' } as any;

    const result = await controller.create(dto);

    expect(campaignsService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'created' });
  });

  it('createMine() forwards the dto and the current user id', async () => {
    const { controller, campaignsService } = createController();
    const dto = { title: 'x' } as any;

    const result = await controller.createMine(dto, user);

    expect(campaignsService.createForCurrentInstitution).toHaveBeenCalledWith(
      dto,
      'user-1',
    );
    expect(result).toEqual({ id: 'created-mine' });
  });

  it('createMine() tolerates an undefined user', async () => {
    const { controller, campaignsService } = createController();
    const dto = { title: 'x' } as any;

    await controller.createMine(dto, undefined);

    expect(campaignsService.createForCurrentInstitution).toHaveBeenCalledWith(
      dto,
      undefined,
    );
  });

  it('publishMine() delegates with the campaign id and user id', async () => {
    const { controller, campaignsService } = createController();

    const result = await controller.publishMine('camp-1', user);

    expect(
      campaignsService.publishForCurrentInstitution,
    ).toHaveBeenCalledWith('camp-1', 'user-1');
    expect(result).toEqual({ id: 'published' });
  });

  it('createComment() delegates with id, content and user id', async () => {
    const { controller, campaignsService } = createController();

    const result = await controller.createComment(
      'camp-1',
      { content: 'Olá' },
      user,
    );

    expect(campaignsService.createComment).toHaveBeenCalledWith(
      'camp-1',
      'Olá',
      'user-1',
    );
    expect(result).toEqual({ id: 'comment-1' });
  });

  it('listComments() delegates with the campaign id', async () => {
    const { controller, campaignsService } = createController();

    const result = await controller.listComments('camp-1');

    expect(campaignsService.listComments).toHaveBeenCalledWith('camp-1');
    expect(result).toEqual([{ id: 'comment-1' }]);
  });

  it('getRecentDonors() parses a provided limit', async () => {
    const { controller, campaignsService } = createController();

    await controller.getRecentDonors('camp-1', '5');

    expect(campaignsService.getRecentDonors).toHaveBeenCalledWith(
      'camp-1',
      5,
    );
  });

  it('getRecentDonors() passes undefined when no limit is given', async () => {
    const { controller, campaignsService } = createController();

    await controller.getRecentDonors('camp-1', undefined);

    expect(campaignsService.getRecentDonors).toHaveBeenCalledWith(
      'camp-1',
      undefined,
    );
  });

  it('like() delegates with the campaign id and user id', async () => {
    const { controller, campaignsService } = createController();

    const result = await controller.like('camp-1', user);

    expect(campaignsService.like).toHaveBeenCalledWith('camp-1', 'user-1');
    expect(result).toEqual({ campaignId: '1', liked: true });
  });

  it('unlike() delegates with the campaign id and user id', async () => {
    const { controller, campaignsService } = createController();

    const result = await controller.unlike('camp-1', user);

    expect(campaignsService.unlike).toHaveBeenCalledWith('camp-1', 'user-1');
    expect(result).toEqual({ campaignId: '1', liked: false });
  });

  it('share() delegates with the campaign id', async () => {
    const { controller, campaignsService } = createController();

    const result = await controller.share('camp-1');

    expect(campaignsService.share).toHaveBeenCalledWith('camp-1');
    expect(result).toEqual({ campaignId: '1', sharesCount: 1 });
  });

  it('findAll() delegates with the query', async () => {
    const { controller, campaignsService } = createController();
    const query = { search: 'foo' };

    const result = await controller.findAll(query);

    expect(campaignsService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual([{ id: '1' }]);
  });

  it('findMine() delegates with the user id and query', async () => {
    const { controller, campaignsService } = createController();
    const query = { page: '1' };

    const result = await controller.findMine(user, query);

    expect(campaignsService.findMine).toHaveBeenCalledWith('user-1', query);
    expect(result).toEqual([{ id: 'mine-1' }]);
  });

  it('getMyLikedCampaignIds() delegates with the user id', async () => {
    const { controller, campaignsService } = createController();

    const result = await controller.getMyLikedCampaignIds(user);

    expect(campaignsService.getMyLikedCampaignIds).toHaveBeenCalledWith(
      'user-1',
    );
    expect(result).toEqual(['1', '2']);
  });

  it('findOne() delegates with the campaign id', async () => {
    const { controller, campaignsService } = createController();

    const result = await controller.findOne('camp-1');

    expect(campaignsService.findOne).toHaveBeenCalledWith('camp-1');
    expect(result).toEqual({ id: '1' });
  });

  it('update() delegates with the campaign id and dto', async () => {
    const { controller, campaignsService } = createController();
    const dto = { title: 'updated' } as any;

    const result = await controller.update('camp-1', dto);

    expect(campaignsService.update).toHaveBeenCalledWith('camp-1', dto);
    expect(result).toEqual({ id: '1', title: 'updated' });
  });

  it('remove() delegates with the campaign id', async () => {
    const { controller, campaignsService } = createController();

    const result = await controller.remove('camp-1');

    expect(campaignsService.remove).toHaveBeenCalledWith('camp-1');
    expect(result).toEqual({ id: '1' });
  });
});

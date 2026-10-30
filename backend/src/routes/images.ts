import { Router } from 'express';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../lib/http';
import { checkImageRequest, fetchImage } from '../services/images';

export const imagesRouter = Router();


imagesRouter.get(
  '/:imageId',
  asyncHandler(async (req, res) => {
    const imageId = String(req.params.imageId);
    const width = req.query.w === undefined ? 843 : Number(req.query.w);
    checkImageRequest(imageId, width);

    let image;
    try {
      image = await fetchImage(imageId, width);
    } catch (err) {
      if (err instanceof AppError && err.code === 'IMAGE_NOT_FOUND') res.set('Cache-Control', 'public, max-age=300');
      throw err;
    }
    res.set({
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(image.body);
  }),
);
